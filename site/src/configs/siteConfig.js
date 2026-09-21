const faviconSizes = [16, 32, 48, 180, 192];

export default {
  favicons: faviconSizes.map(
    (size) =>
      `${import.meta.env.BASE_URL}favicons/lilis-game-engine-favicon-${size}.png`,
  ),
};
