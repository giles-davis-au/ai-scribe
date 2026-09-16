<script lang="ts">
  import Recorder from '$lib/components/Recorder.svelte';
  import ResultView from '$lib/components/ResultView.svelte';
  import { createSession, uploadAudio } from '$lib/api/client';
  import type { Session } from '$lib/types';

  type State = 'idle' | 'processing' | 'done' | 'error';

  let state: State = $state('idle');
  let session: Session | null = $state(null);
  let errorMessage = $state('');

  async function handleRecorded(blob: Blob) {
    state = 'processing';
    errorMessage = '';

    try {
      const created = await createSession();
      session = await uploadAudio(created.id, blob);

      if (session.status === 'failed') {
        errorMessage = session.error ?? 'Processing failed';
        state = 'error';
      } else {
        state = 'done';
      }
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Something went wrong';
      state = 'error';
    }
  }

  function reset() {
    state = 'idle';
    session = null;
    errorMessage = '';
  }
</script>

<main>
  <h1>AI Scribe</h1>

  <p>An ambient clinical scribe demo — record a conversation, and it automatically
    transcribes it, extracts key clinical details, and generates a structured SOAP note.</p>
  <p>Under the hood: audio is transcribed with OpenAI's Whisper, then GPT-4o extracts
    clinical facts and drafts the note.</p>
  <p>⚠️ This is a portfolio/demo prototype, not a production or clinically validated tool.
    Please don't record or enter real patient or personal health information — use a
    sample conversation instead.</p>

  {#if state === 'idle' || state === 'error'}
    <Recorder onRecorded={handleRecorded} />
  {/if}

  {#if state === 'processing'}
    <p>Processing — this may take up to 60 seconds…</p>
  {/if}

  {#if state === 'error'}
    <p>Error: {errorMessage}</p>
    <button onclick={reset}>Try again</button>
  {/if}

  {#if state === 'done' && session}
    <ResultView {session} />
    <button onclick={reset}>New recording</button>
  {/if}
</main>
