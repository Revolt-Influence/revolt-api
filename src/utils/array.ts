export function arrayDiff(array1: any[], array2: any[]) {
  const arrays = [array1, array2].sort((a, b) => a.length - b.length)
  const smallSet = new Set(arrays[0])
  return arrays[1].filter(x => !smallSet.has(x))
}

export function flatten2dArray<T>(arrayOfArrays: T[][]): T[] {
  return [].concat(...arrayOfArrays)
}

export function getMedian(array: number[]): number {
  // Handle no-video channels
  if (array.length === 0) {
    return 0
  }
  const middleIndex = Math.floor(array.length / 2)
  const sortedNumbers = [...array].sort((a, b) => a - b)
  return array.length % 2 !== 0
    ? sortedNumbers[middleIndex]
    : (sortedNumbers[middleIndex - 1] + sortedNumbers[middleIndex]) / 2
}
