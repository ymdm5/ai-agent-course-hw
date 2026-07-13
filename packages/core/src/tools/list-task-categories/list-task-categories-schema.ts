import { z } from 'zod';

export const ListTaskCategoriesInputSchema = z.object({}).passthrough();

export const TaskCategorySchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});

export const ListTaskCategoriesOutputSchema = z.array(TaskCategorySchema);

export type TaskCategory = z.infer<typeof TaskCategorySchema>;
