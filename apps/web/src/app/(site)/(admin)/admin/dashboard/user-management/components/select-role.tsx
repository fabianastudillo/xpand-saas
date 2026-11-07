"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { UserRole } from "@prisma/client";

import { updateUserRoleAction } from "../actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectRoleProps {
  userRoleName: UserRole;
  email: string;
}

const initialState = {
  message: "",
  error: false,
};

export const SelectRole = ({ userRoleName, email }: SelectRoleProps) => {
  const [, startTransition] = useTransition();

  // The action is called directly and its result shown once: with useActionState + an effect on the state,
  // React 19 delivered the toast twice.
  const handleChange = (value: string) => {
    const formData = new FormData();
    formData.append("email", email);
    formData.append("roleToUpdate", value);
    startTransition(async () => {
      const state = await updateUserRoleAction(initialState, formData);
      if (state.message) {
        toast[state.error ? "error" : "success"](state.message);
      }
    });
  };

  return (
    <Select defaultValue={userRoleName} onValueChange={handleChange}>
      <SelectTrigger className="w-[180px]" aria-label="select user role">
        <SelectValue placeholder="Select user role" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          role="option"
          aria-label={UserRole.ADMIN}
          value={UserRole.ADMIN}
        >
          {UserRole.ADMIN}
        </SelectItem>
        <SelectItem
          role="option"
          aria-label={UserRole.USER}
          value={UserRole.USER}
        >
          {UserRole.USER}
        </SelectItem>
      </SelectContent>
    </Select>
  );
};
