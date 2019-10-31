import moment from 'moment'

export function throttle(milliseconds: number): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve()
    }, milliseconds)
  })
}

export function removeTimeFromDate(date: Date): Date {
  const withoutTime = moment(date).startOf('day')
  return withoutTime.toDate()
}
