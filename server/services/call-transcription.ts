import OpenAI from "openai";
import { env } from "../config/env";
import { storage } from "../storage";
import { getTwilioClient, getTwilioAccountSid } from "../twilio";
import type { CallExtractedData, WorkflowData } from "@shared/schema";

// Initialize OpenAI client for Whisper
function getOpenAIClient(): OpenAI {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for call transcription");
  }
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

interface TranscriptionResult {
  transcript: string;
  extractedData: CallExtractedData;
}

/**
 * Download recording audio from Twilio
 */
async function downloadRecording(recordingUrl: string): Promise<Buffer> {
  const accountSid = await getTwilioAccountSid();

  // Twilio recordings require authentication
  const authUrl = recordingUrl.includes("?")
    ? `${recordingUrl}&Download=true`
    : `${recordingUrl}.mp3`;

  const response = await fetch(authUrl, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download recording: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Transcribe audio using OpenAI Whisper
 */
async function transcribeWithWhisper(audioBuffer: Buffer): Promise<string> {
  const openai = getOpenAIClient();

  // Create a File object from the buffer
  const file = new File([audioBuffer], "recording.mp3", { type: "audio/mpeg" });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "en",
    response_format: "text",
  });

  return transcription;
}

/**
 * Extract structured data from transcript using GPT
 */
async function extractDataFromTranscript(transcript: string): Promise<CallExtractedData> {
  const openai = getOpenAIClient();

  const systemPrompt = `You are an AI assistant that extracts structured information from phone call transcripts for a window tinting business.

Extract the following information if mentioned in the transcript:
- address: Full street address if provided
- city: City name
- vehicleYear: Year of the vehicle (e.g., "2022")
- vehicleMake: Make of the vehicle (e.g., "Toyota")
- vehicleModel: Model of the vehicle (e.g., "Camry")
- vehicleType: Type of vehicle (car, truck, suv, van, commercial)
- serviceRequested: What tinting service they want (full tint, sides and rear, windshield strip, etc.)
- appointmentDate: Any mentioned date for appointment
- appointmentTime: Any mentioned time for appointment
- priceDiscussed: Any price or quote mentioned
- notes: Any other important details from the call

Return a JSON object with these fields. Use null for any fields not mentioned in the transcript.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Extract information from this call transcript:\n\n${transcript}` },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {};
  }

  try {
    const parsed = JSON.parse(content);
    // Clean up null values
    const cleaned: CallExtractedData = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (value !== null && value !== undefined && value !== "") {
        (cleaned as Record<string, string>)[key] = String(value);
      }
    }
    return cleaned;
  } catch (error) {
    console.error("Failed to parse extracted data:", error);
    return {};
  }
}

/**
 * Update workflow profile with extracted call data
 */
async function updateWorkflowWithExtractedData(
  conversationId: string,
  extractedData: CallExtractedData,
): Promise<void> {
  const existingState = await storage.getWorkflowStateByConversationId(conversationId);
  if (!existingState) {
    console.log("No workflow state found for conversation, skipping profile update");
    return;
  }

  const currentData = existingState.data as WorkflowData;
  const currentProfile = currentData.profile || {};

  // Merge extracted data into profile (don't overwrite existing values)
  const updatedProfile = {
    ...currentProfile,
    address: currentProfile.address || extractedData.address,
    city: currentProfile.city || extractedData.city,
    vehicleYear: currentProfile.vehicleYear || extractedData.vehicleYear,
    vehicleMake: currentProfile.vehicleMake || extractedData.vehicleMake,
    vehicleModel: currentProfile.vehicleModel || extractedData.vehicleModel,
    vehicleType: currentProfile.vehicleType || extractedData.vehicleType,
    coverageWanted: currentProfile.coverageWanted || extractedData.serviceRequested,
    preferredDay: currentProfile.preferredDay || extractedData.appointmentDate,
    preferredTime: currentProfile.preferredTime || extractedData.appointmentTime,
    budget: currentProfile.budget || extractedData.priceDiscussed,
    notes: extractedData.notes
      ? currentProfile.notes
        ? `${currentProfile.notes}\n\nFrom call: ${extractedData.notes}`
        : `From call: ${extractedData.notes}`
      : currentProfile.notes,
  };

  await storage.updateWorkflowState(conversationId, {
    data: {
      ...currentData,
      profile: updatedProfile,
    },
  });

  console.log(`Updated workflow profile for conversation ${conversationId} with call data`);
}

/**
 * Process a call recording: download, transcribe, extract data, and store
 */
export async function processCallRecording(
  callId: string,
  recordingUrl: string,
  conversationId: string,
): Promise<TranscriptionResult> {
  console.log(`Processing call recording for call ${callId}`);

  // Update status to processing
  await storage.updateCall(callId, { transcriptionStatus: "processing" });

  try {
    // Step 1: Download the recording
    console.log("Downloading recording from Twilio...");
    const audioBuffer = await downloadRecording(recordingUrl);
    console.log(`Downloaded ${audioBuffer.length} bytes`);

    // Step 2: Transcribe with Whisper
    console.log("Transcribing with Whisper...");
    const transcript = await transcribeWithWhisper(audioBuffer);
    console.log(`Transcription complete: ${transcript.length} characters`);

    // Step 3: Extract structured data
    console.log("Extracting structured data...");
    const extractedData = await extractDataFromTranscript(transcript);
    console.log("Extracted data:", extractedData);

    // Step 4: Store the results
    await storage.updateCallTranscription(callId, transcript, extractedData);

    // Step 5: Update workflow profile with extracted data
    await updateWorkflowWithExtractedData(conversationId, extractedData);

    console.log(`Successfully processed call recording for call ${callId}`);

    return { transcript, extractedData };
  } catch (error) {
    console.error(`Failed to process call recording for call ${callId}:`, error);
    await storage.updateCall(callId, { transcriptionStatus: "failed" });
    throw error;
  }
}

/**
 * Handle recording status callback from Twilio
 */
export async function handleRecordingReady(
  callSid: string,
  recordingSid: string,
  recordingUrl: string,
  recordingDuration: number,
): Promise<void> {
  console.log(`Recording ready for call ${callSid}: ${recordingSid}`);

  // Find the call record
  const call = await storage.getCallByCallSid(callSid);
  if (!call) {
    console.error(`No call record found for CallSid ${callSid}`);
    return;
  }

  // Update call with recording info
  await storage.updateCall(call.id, {
    recordingUrl,
    recordingSid,
    durationSeconds: recordingDuration,
  });

  // Process the recording asynchronously
  processCallRecording(call.id, recordingUrl, call.conversationId).catch((error) => {
    console.error("Background transcription failed:", error);
  });
}
