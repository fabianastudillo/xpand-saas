"use client";

import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { toggleFeatureFlagAction } from "../actions";

interface FeatureFlagSwitchProps {
  isEnabled: boolean;
  name: string;
}

// A client component must not be async (React 19 refuses to render it); the action is awaited in the handler.
export const FeatureFlagSwitch = ({
  name,
  isEnabled,
}: FeatureFlagSwitchProps) => {
  const handleToggle = async () => {
    const result = await toggleFeatureFlagAction(name, !isEnabled);

    if (result.success) {
      toast.success("Feature flag updated successfully");
    }
  };

  return (
    <Switch
      onCheckedChange={handleToggle}
      defaultChecked={isEnabled}
      title={isEnabled ? "Enabled" : "Disabled"}
    />
  );
};
