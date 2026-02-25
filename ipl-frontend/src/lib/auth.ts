import { api } from "./api"

/* REQUESTS */

export const signup = async (data: {
  name: string
  email: string
  password: string
}) => {
  const res = await api.post("/auth/signup", data)
  return res.data
}

export const verifyOtp = async (data: {
  email: string
  otp: string
}) => {
  const res = await api.post("/auth/verify-otp", data)
  return res.data
}

export const login = async (data: {
  email: string
  password: string
}) => {
  const res = await api.post("/auth/login", data)
  return res.data
}

export const logout = async () => {
  const res = await api.post("/auth/logout")
  return res.data
}

/* ✅ ME ENDPOINT */

export const me = async () => {
  const res = await api.get("/auth/me")
  return res.data
}

/* API OBJECT */

export const authApi = {
  signup,
  verifyOtp,
  login,
  logout,
  me,

  debugAuth: () =>
    api.get("/auth/debug-auth").then(res => res.data),
}