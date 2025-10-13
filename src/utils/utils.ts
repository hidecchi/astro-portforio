export const loadGLSLFile = async (url: URL): Promise<string> => {
  try {
    const response = await fetch(url);
    return await response.text();
  } catch (error) {
    console.error("Failed to load shader:", error);
    return "";
  }
};

export const isSmartPhone = () => {
  // UserAgentからのスマホ判定
  if (navigator.userAgent.match(/iPhone|Android.+Mobile/)) {
    return true;
  } else {
    return false;
  }
};

export const isAndroid = () => {
  return /Android/.test(navigator.userAgent);
};
