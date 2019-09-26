function throttle(milliseconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}

export { throttle }
