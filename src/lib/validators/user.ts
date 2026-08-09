import { z } from "zod";

export const userRoleSchema = z.enum(["SUPER_ADMIN", "ADMIN", "LECTURER"]);
export const userStatusSchema = z.enum(["ACTIVE", "INACTIVE", "PENDING"]);

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Enter a valid email address"),
  role: userRoleSchema,
  title: z.string().max(50).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  staffId: z.string().max(50).optional().or(z.literal("")),
  // Optional rather than defaulted so the inferred input and output types match,
  // which keeps react-hook-form's resolver types happy.
  moduleIds: z.array(z.string()).optional(),
});

export const updateUserSchema = createUserSchema.partial().extend({
  status: userStatusSchema.optional(),
});

/**
 * All an invited person does is choose a password. Their name, title, phone and
 * staff ID were entered by the administrator who created the account, and the
 * administrator remains the one who corrects them.
 */
export const acceptInviteSchema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    password: z.string().min(8, "Use at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
