# Phase 2C-2 Demo Fallback Visual Acceptance Report

Date: 2026-07-07

## Base Checkpoint

- Commit: 3de2877b9ce5547eed1336a763de66e4daad6a58
- Tag: nova_phase2c_demo_fallback_v1

## Local Preview Runtime URLs

- NOVA runtime: http://127.0.0.1:8080/nova.html
- Vite preview: http://127.0.0.1:5173/AIPEOPLE/

These URLs were used for local preview validation only. No tunnel URL or token is recorded in this report.

## API Result Summary

- nova.html: 200
- /agent/task: triggered successfully
- SSE /agent/task/{id}/events: connected
- Render provider used: DemoRenderFallbackProvider
- Fallback mode: demo
- task_failed: not observed
- beauty_render_failed: not observed

## Visual Acceptance Result Summary

- Login page: 200
- Login page title: Earth Portal
- Login page: normal
- NOVA page: normal
- Workbench: opened and entered render flow
- Fallback final image: displayed in the real preview UI

## Final Image Validation

- Final image fetch: 200 image/png
- PNG bytes: 22992
- PNG signature: 89504e470d0a1a0a
- Output: valid PNG

## Console Result

- Login/Vite preview console errors: 0
- NOVA render flow: no page exception
- NOVA render flow: no failed UI

## Files Intentionally Not Committed

- .env
- generated_assets screenshots
- token
- runtime URL

## Conclusion

Phase 2C-2 is complete. Demo fallback mode prevents interview demo failure when Colab/tunnel is unavailable, and the fallback final image is visible in the real preview UI.
