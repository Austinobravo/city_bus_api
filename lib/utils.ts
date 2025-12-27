import bcrypt from "bcryptjs"

export const comparePassword = async (currentPassword: string, hashPassword: string) => {
    const isPasswordCorrect = bcrypt.compareSync(currentPassword, hashPassword)
    return isPasswordCorrect
}