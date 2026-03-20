<script lang="ts">
  import type { Session } from '../types';
  export let session: Session;
</script>

<section>
  <h2>Transcript</h2>
  <p>{session.transcript ?? '—'}</p>

  {#if session.soapNote}
    <h2>SOAP Note</h2>

    <h3>Subjective</h3>
    <p>{session.soapNote.subjective}</p>

    <h3>Objective</h3>
    <p>{session.soapNote.objective}</p>

    <h3>Assessment</h3>
    <p>{session.soapNote.assessment}</p>

    <h3>Plan</h3>
    <p>{session.soapNote.plan}</p>
  {/if}
</section>
