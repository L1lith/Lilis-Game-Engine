export default function translateToNewOrigin(position, oldOrigin, newOrigin) {
  const originOffset = newOrigin - oldOrigin;
  return position + originOffset;
}
