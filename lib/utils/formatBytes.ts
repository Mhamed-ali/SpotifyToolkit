export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function calculateDataSize(data: any): string {
  try {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    let byteLength = 0;
    if (typeof Buffer !== 'undefined') {
      byteLength = Buffer.byteLength(jsonString, 'utf8');
    } else if (typeof Blob !== 'undefined') {
      byteLength = new Blob([jsonString]).size;
    } else {
      byteLength = jsonString.length; // fallback
    }
    return formatBytes(byteLength);
  } catch (error) {
    return 'Unknown Size';
  }
}
