import {writeFile, readFileSync} from 'fs'

export const saveJSON = (
  object: Record<string | number, any>,
  path: string,
) => {
  writeFile(path, JSON.stringify(object, null, 2), (err) => {
    if (err) {
      console.error('Error writing file:', err)
    } else {
      console.log('JSON file has been saved.')
    }
  })
}

export const getJSONSync = (path: string): Record<string, any> | null => {
  try {
    const data = readFileSync(path, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    console.error('Error reading or parsing file:', error)
    return null // Return null in case of error
  }
}

export const sittingPosition = getJSONSync('jsons/sittingPosition.json')

export const convertToNumberRecord = <T>(
  obj: Record<string, T>,
): Record<number, T> => {
  const result: Record<number, T> = {}

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const numericKey = Number(key)
      if (!isNaN(numericKey)) {
        result[numericKey] = obj[key] as T
      }
    }
  }

  return result
}

export const comparePositions = (
  currentPosition: Record<number, number>,
  templatePosition: Record<number, number>,
  coefficient: number = 125,
): boolean => {
  let sumOfSquares = 0

  for (const key in currentPosition) {
    if (
      currentPosition.hasOwnProperty(key) &&
      templatePosition.hasOwnProperty(key)
    ) {
      const currentValue = currentPosition[key] as number
      const templateValue = templatePosition[Number(key)] as number

      // Convert from 0-4096 to -10 to 10, for comparing conveniency
      const currentScaled = (currentValue / 4096) * 20 - 10
      const templateScaled = (templateValue / 4096) * 20 - 10

      // Calculate the squared difference
      const difference = currentScaled - templateScaled
      sumOfSquares += difference ** 2
    }
  }

  // Divide the sum of squares by the coefficient
  return sumOfSquares / coefficient < 1
}

export const isRobotSitting = (
  currentPosition: Record<number, number>,
): boolean => {
  if (!sittingPosition) {
    return false
  }

  return comparePositions(currentPosition, sittingPosition)
}
