import { useState } from 'react';

import { personaOf, type Call } from '@/call/call';
import { useLevels } from '@/call/use-call';
import { Persona, type PersonaProps } from '@/components/persona';

// The orb's face. Only it redraws as hex starts and stops speaking.
export function CallPersona({ call, ...persona }: { call: Call } & Omit<PersonaProps, 'state'>) {
  const [speaking, setSpeaking] = useState(false);
  useLevels(({ output }) => setSpeaking(output > 0.035));
  return <Persona {...persona} state={personaOf(call, speaking)} />;
}
