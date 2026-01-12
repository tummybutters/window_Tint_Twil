import { TrendingUp, DollarSign, Target, Heart, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import type { LeadAssessment, Sentiment } from "@shared/schema";

interface LeadAssessmentCardProps {
  assessment: LeadAssessment | null | undefined;
  isLoading?: boolean;
}

function getSentimentColor(sentiment?: Sentiment): string {
  switch (sentiment) {
    case "Positive":
      return "text-chart-2";
    case "Negative":
      return "text-chart-5";
    case "Neutral":
      return "text-chart-4";
    default:
      return "text-muted-foreground";
  }
}

function getProbabilityColor(probability: string): string {
  const value = parseInt(probability.replace("%", ""));
  if (value >= 70) return "text-chart-2";
  if (value >= 40) return "text-chart-4";
  return "text-chart-5";
}

export function LeadAssessmentCard({ assessment, isLoading }: LeadAssessmentCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 768px)").matches;
    setIsCollapsed(isMobile);
  }, []);

  if (isLoading) {
    return (
      <Card className="hover-elevate">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Lead Assessment</CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setIsCollapsed(!isCollapsed)}
            data-testid="button-toggle-assessment"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>
        {!isCollapsed && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="h-2 bg-muted rounded animate-pulse" />
                  <div className="h-6 bg-muted rounded animate-pulse" />
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    );
  }

  if (!assessment) {
    return (
      <Card className="hover-elevate">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Lead Assessment</CardTitle>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => setIsCollapsed(!isCollapsed)}
            data-testid="button-toggle-assessment"
          >
            {isCollapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </CardHeader>
        {!isCollapsed && (
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">
              AI lead assessment will appear here after analyzing the conversation.
            </p>
          </CardContent>
        )}
      </Card>
    );
  }

  return (
    <Card className="hover-elevate" data-testid="card-lead-assessment">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm font-medium">Lead Assessment</CardTitle>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => setIsCollapsed(!isCollapsed)}
          data-testid="button-toggle-assessment"
        >
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Stage</p>
              </div>
              <p className="text-lg font-semibold text-chart-3" data-testid="text-stage">
                {assessment.stage || "N/A"}
              </p>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Probability</p>
              </div>
              <p
                className={`text-lg font-semibold ${assessment.probability ? getProbabilityColor(assessment.probability) : "text-muted-foreground"}`}
                data-testid="text-probability"
              >
                {assessment.probability || "N/A"}
              </p>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Est. Value</p>
              </div>
              <p className="text-lg font-semibold" data-testid="text-est-value">
                {assessment.estValue || "N/A"}
              </p>
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-muted-foreground" />
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Sentiment</p>
              </div>
              <p
                className={`text-lg font-semibold ${getSentimentColor(assessment.sentiment as Sentiment)}`}
                data-testid="text-sentiment"
              >
                {assessment.sentiment || "N/A"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-3 border-t border-border">
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Vehicle</p>
              <p className="text-sm font-medium">{assessment.vehicleInfo || "Not specified"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Film Type</p>
              <p className="text-sm font-medium capitalize">{assessment.tintPreference || "Undecided"}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Coverage</p>
              <p className="text-sm font-medium capitalize">{assessment.coverage?.replace('_', ' ') || "TBD"}</p>
            </div>
          </div>

          {assessment.notes && (
            <div className="pt-3 border-t border-border">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
              <p className="text-xs text-foreground" data-testid="text-notes">
                {assessment.notes}
              </p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
