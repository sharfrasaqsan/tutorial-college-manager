import { z } from "zod";

export const CreateTeacherSchema = z.object({
  name: z.string().trim().min(2, "Teacher name must be at least 2 characters."),
  email: z.string().trim().email("Please provide a valid email address.").toLowerCase(),
  phone: z.string().trim().min(7, "Please provide a valid contact phone number."),
  photoUrl: z.string().trim().url().optional().or(z.literal("")),
  bio: z.string().trim().max(1000, "Bio cannot exceed 1000 characters.").optional().or(z.literal("")),
  subjects: z.array(z.string().trim()).default([]),
  showOnPublicSite: z.boolean().default(true),
  password: z.string().min(6, "Password must be at least 6 characters.").optional().or(z.literal("")),
});

export const UpdateTeacherSchema = z.object({
  name: z.string().trim().min(2, "Teacher name must be at least 2 characters."),
  phone: z.string().trim().min(7, "Please provide a valid contact phone number."),
  photoUrl: z.string().trim().url().optional().or(z.literal("")),
  bio: z.string().trim().max(1000, "Bio cannot exceed 1000 characters.").optional().or(z.literal("")),
  subjects: z.array(z.string().trim()).default([]),
  showOnPublicSite: z.boolean().default(true),
});

export const ToggleTeacherStatusSchema = z.object({
  active: z.boolean(),
});

export type CreateTeacherInput = z.infer<typeof CreateTeacherSchema>;
export type UpdateTeacherInput = z.infer<typeof UpdateTeacherSchema>;
