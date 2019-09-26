function arrayDiff(array1: any[], array2: any[]) {
  const arrays = [array1, array2].sort((a, b) => a.length - b.length)
  const smallSet = new Set(arrays[0])
  return arrays[1].filter(x => !smallSet.has(x))
}

function flatten2dArray<T>(arrayOfArrays: T[][]): T[] {
  return [].concat(...arrayOfArrays)
}

export { arrayDiff, flatten2dArray }
