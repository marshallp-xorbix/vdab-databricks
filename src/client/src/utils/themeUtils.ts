export const getOutlineColor = (textColor: string): string => {
  const hexMatch = /^#([0-9a-fA-F]{6})$/.exec(textColor);
  if (hexMatch) {
    const hexValue = hexMatch[1];
    const red = parseInt(hexValue.slice(0, 2), 16);
    const green = parseInt(hexValue.slice(2, 4), 16);
    const blue = parseInt(hexValue.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, 0.28)`;
  }

  return "rgba(100, 116, 139, 0.45)";
};
