import { Touchpad, type LucideProps } from "lucide-react";

const TouchpadFlippedIcon = (props: LucideProps) => (
  <Touchpad {...props} style={{ ...(props.style ?? {}), transform: "rotate(180deg)" }} />
);

export default TouchpadFlippedIcon;