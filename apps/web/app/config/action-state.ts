export type ConfigActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const INITIAL_CONFIG_ACTION_STATE: ConfigActionState = {
  status: "idle",
  message: "",
};
