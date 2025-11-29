# Send Trip Sheet Notification

This Cloud Function sends a push notification to a worker when a new trip sheet is approved and created for them.

## Deployment

Deploy this function using Google Cloud Functions (Gen 2) with an Eventarc trigger on the `tripSheets` Firestore collection.

### Prerequisites

- Ensure you are authenticated with `gcloud`.
- Ensure the project ID is set correctly.

### Deploy Command

Run the following command from the root of the repository or from within this directory:

```bash
gcloud functions deploy send-trip-sheet-notification \
  --gen2 \
  --runtime=nodejs18 \
  --region=us-central1 \
  --source=./send-trip-sheet-notification \
  --entry-point=sendTripSheetNotification \
  --trigger-event-filters=type=google.cloud.firestore.document.v1.created \
  --trigger-event-filters=database='(default)' \
  --trigger-event-filters-path-pattern=document='tripSheets/{docId}' \
  --allow-unauthenticated
```

## Function Logic

1.  **Trigger:** Validates the event is a document creation in `tripSheets`.
2.  **Payload Extraction:** Reads `technicianId` and `date` from the created document.
3.  **Token Lookup:** Queries the `worker_fcm_tokens` collection where `technicianId` matches the trip sheet's technician.
4.  **Notification:** Sends an FCM notification with the title "Your Trip-sheet is Ready" and the body "A Trip-sheet for [Month Day] has been sent to you!".
5.  **Maintenance:** Automatically deletes invalid FCM tokens from Firestore.
