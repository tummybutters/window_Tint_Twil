import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Booking() {
  const bookingUrl = "https://www.obsidianautoworksoc.com/#CONTACT";

  useEffect(() => {
    // Optional: Auto-redirect
    // window.location.href = bookingUrl;
  }, []);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Schedule Appointment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            We use our website to manage bookings. Please click the button below to schedule your tinting service.
          </p>
          <Button
            className="w-full"
            onClick={() => window.location.href = bookingUrl}
          >
            Go to Booking Page
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
