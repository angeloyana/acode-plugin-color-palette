/**
 * @param {Object} obj
 * @returns {number}
 */
export function maxKey(obj) {
  let max = 0;

  Object.keys(obj).forEach((key) => {
    const current = parseInt(key);
    if (!isNaN(current) && current > max) {
      max = current;
    }
  });

  return max;
}
