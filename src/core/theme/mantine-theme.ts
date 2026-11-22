import { createTheme } from "@mantine/core";

export const centralTheme = createTheme({
  primaryColor: "red",
  primaryShade: 7,
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
  defaultRadius: "md",
  components: {
    Button: { defaultProps: { radius: "md" } },
    TextInput: { defaultProps: { radius: "md" } },
    NumberInput: { defaultProps: { radius: "md" } },
    PasswordInput: { defaultProps: { radius: "md" } },
    Textarea: { defaultProps: { radius: "md" } },
    Select: { defaultProps: { radius: "md" } },
    Modal: { defaultProps: { centered: true, radius: "lg" } },
    Paper: { defaultProps: { radius: "lg" } },
  },
});
