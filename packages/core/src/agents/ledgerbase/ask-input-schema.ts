import { z } from 'zod';

export const AskInputSchema = z.object({
  question: z.string().trim().min(1),
});

export type AskInput = z.infer<typeof AskInputSchema>;
