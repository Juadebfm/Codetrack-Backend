import mongoose from "mongoose";

const goalSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    tittle: {
        type: String,
        required: true,
        trim: true,
        maxLength:20
    },
    curentValue: {
         type: Number,
        required: true,
        trim: true,
        maxLength:0
    },
    tagetValue: {
        type: Number,
        required: true,
        minLength:1
    },
    Value: {
        type: String,
        required: true,
        trim: true,
        maxLength:0
    }.
}
{ timestaamp = true }
)