# Status Change Notification Function

This Cloud Function sends an FCM notification to admins whenever a Job document in Firestore has its `status` field updated.

## Prerequisites

1.  **Google Cloud Project**: Ensure your project is selected in `gcloud`.
2.  **APIs Enabled**: Ensure `eventarc.googleapis.com` and `run.googleapis.com` are enabled.
3.  **Permissions**: The service account used by Eventarc must have permission to invoke Cloud Run functions.

## Deployment

Deploy the function using the `gcloud` command line tool. This command sets up an Eventarc trigger for the `google.cloud.firestore.document.v1.updated` event on the `jobs` collection.

```bash
gcloud functions deploy status-change-notification \
  --gen2 \
  --runtime=nodejs18 \
  --region=us-central1 \
  --source=. \
  --entry-point=statusChangeNotification \
  --trigger-event-filters="type=google.cloud.firestore.document.v1.updated" \
  --trigger-event-filters="database=(default)" \
  --trigger-event-filters="namespace=(default)" \
  --trigger-event-filters-path-pattern="document=jobs/{jobId}"
```

### Explanation of Flags:

*   `--gen2`: Uses 2nd Gen Cloud Functions (powered by Cloud Run).
*   `--runtime=nodejs18`: Specifies the Node.js runtime version.
*   `--region=us-central1`: Deploys to the US Central 1 region (match this to your Firestore location if possible for latency).
*   `--source=.`: Uploads the current directory as the source code.
*   `--entry-point=statusChangeNotification`: The name of the exported function in `index.js`.
*   `--trigger-event-filters`: Specifies the Eventarc matching criteria. We listen for `updated` events on the default database/namespace.
*   `--trigger-event-filters-path-pattern="document=jobs/{jobId}"`: Restricts the trigger to documents within the `jobs` collection.

## Testing

1.  Go to the Firestore console or use your app.
2.  Find an existing job document.
3.  Change the `status` field (e.g., from "Scheduled" to "Completed").
4.  Check the Cloud Function logs to verify execution.
5.  Check your device (if token is registered) for the notification.

## Payload details

The function checks if `oldValue.status` !== `newValue.status`. If true, it sends a notification:

*   **Title**: "Status change!"
*   **Body**: "[Customer Name]'s Job has changed status from [Old Status] to [New Status]"
