const getEnv = (key: string): string => {
  const value = process.env[key]
  if (!value) {
    throw new Error(`Missing env variable: ${key}`)
  }
  return value
}

export const ENV = {
  TWELVEDATA_API_KEY: getEnv("TWELVEDATA_API_KEY"),
	FMP_API_KEY: getEnv("FMP_API_KEY"),
  ANTHROPIC_API_KEY: getEnv("ANTHROPIC_API_KEY"),
	DATABASE_URL: getEnv("DATABASE_URL"),
	SEC_USER_AGENT: getEnv("SEC_USER_AGENT"),
	SEC_DATA_DIR: getEnv("SEC_DATA_DIR"),
}
