# User Verify Demo

A minimal Node.js web app that lets you:

1. Generate a unique shareable link.
2. Send it to a recipient.
3. See device/browser details appear on your dashboard **after the recipient explicitly clicks Share**.

## Run

```bash
npm start
```

Open http://localhost:3000.

## Notes

- Generated links and visit events are now saved to `data.json`, so they keep working after server restarts.
- The visit page clearly requests consent and only sends data after the user clicks **Share**.
