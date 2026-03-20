<script lang="ts">
  let { onRecorded }: { onRecorded: (blob: Blob) => void } = $props();

  let recording = $state(false);
  let mediaRecorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunks = [];
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder!.mimeType });
      onRecorded(blob);
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorder.start();
    recording = true;
  }

  function stop() {
    mediaRecorder?.stop();
    recording = false;
  }
</script>

{#if !recording}
  <button onclick={start}>Start Recording</button>
{:else}
  <button onclick={stop}>Stop Recording</button>
{/if}
