const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing env variable: ${key}`)
  }
  return value
}

export const ENV = {
  TWELVE_DATA_API_KEY: getEnv("TWELVE_DATA_API_KEY"),
  ANTHROPIC_API_KEY: getEnv("ANTHROPIC_API_KEY"),
	//OPENAI_API_KEY: getEnv("OPENAI_API_KEY"),
}
