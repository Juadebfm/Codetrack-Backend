import mongoose from "mongoose";
import { environment } from "./environment.js"

export async function connectToDatabase() {
    await mongoose .connect(environment.mongodbUri, {
    console.log('Successfully Connected to MongoDB at port $(environment)');
}