import { LearningLog } from "../models/learning-log.model.js";
import { Goal } from "../models/goal.model.js";
import { badRequest, bodyOf } from "../utils/validation.js";

export function publicRecord(record) {
  const value = record.toObject ? record.toObject() : record;
  const { _id, user: _user, __v: _version, ...fields } = value;
  void _user; void _version;
  return { id: String(_id), ...fields };
}
function pagination(query) {
  function number(value, fallback, max) {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      throw badRequest("page and limit must be positive integers; maximum page is 100000 and limit is 100");
    }
    return Number(value);
  }
  return { page: number(query.page, 1, 100000), limit: number(query.limit, 20, 100) };
}
const fields = {
  logs: { title: ["text", 160], tag: ["text", 40], durationMinutes: ["number", 1, 1440], loggedAt: ["date"] },
  goals: { title: ["text", 120], currentValue: ["number", 0], targetValue: ["number", 1], unit: ["text", 30] },
};
function input(request, kind, partial) {
  const body = bodyOf(request);
  const allowed = fields[kind];
  if (!Object.keys(body).length || Object.keys(body).some(key => !Object.hasOwn(allowed, key))) throw badRequest("Provide only editable fields");
  const required = kind === "logs" ? ["title", "tag", "durationMinutes"] : ["title", "targetValue", "unit"];
  if (!partial && required.some(key => body[key] === undefined)) throw badRequest("Required fields are missing");
  const result = {};
  for (const [key, value] of Object.entries(body)) {
    const [type, min, max] = allowed[key];
    if (type === "text") {
      if (typeof value !== "string" || !value.trim() || value.trim().length > min) throw badRequest("Invalid " + key);
      result[key] = key === "tag" ? value.trim().toLowerCase() : value.trim();
    } else if (type === "number") {
      if (typeof value !== "number" || !Number.isFinite(value) || value < min || (max !== undefined && value > max)) throw badRequest("Invalid " + key);
      result[key] = value;
    } else {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) > Date.now()) throw badRequest("loggedAt must be a valid ISO timestamp no later than now");
      result[key] = new Date(value);
    }
  }
  return result;
}
export function resourceController(kind) {
  const Model = kind === "logs" ? LearningLog : Goal;
  const singular = kind === "logs" ? "log" : "goal";
  function filter(request) {
    const id = request.params.id;
    if (!/^[a-f0-9]{24}$/i.test(id)) throw badRequest("Invalid record ID");
    return { _id: id, user: request.user._id };
  }
  function found(record) {
    if (!record) throw Object.assign(new Error("Record not found"), { status: 404 });
    return record;
  }
  return {
    async list(request, response) {
      const { page, limit } = pagination(request.query);
      const where = { user: request.user._id };
      const sort = kind === "logs" ? { loggedAt: -1, _id: -1 } : { createdAt: -1, _id: -1 };
      const [records, total] = await Promise.all([Model.find(where).sort(sort).skip((page - 1) * limit).limit(limit), Model.countDocuments(where)]);
      response.json({ [kind]: records.map(publicRecord), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    },
    async create(request, response) {
      const record = await Model.create({ ...input(request, kind, false), user: request.user._id });
      response.status(201).json({ [singular]: publicRecord(record) });
    },
    async get(request, response) {
      response.json({ [singular]: publicRecord(found(await Model.findOne(filter(request)))) });
    },
    async update(request, response) {
      const where = filter(request);
      const record = await Model.findOneAndUpdate(where, { $set: input(request, kind, true) }, { returnDocument: "after", runValidators: true });
      response.json({ [singular]: publicRecord(found(record)) });
    },
    async remove(request, response) {
      found(await Model.findOneAndDelete(filter(request)));
      response.status(204).end();
    },
  };
}

export function streaks(days, now = new Date()) {
  const today = Math.floor(now.getTime() / 86400000);
  const values = [...new Set(days.map(day => Math.floor(new Date(day).getTime() / 86400000)))].filter(day => day <= today).sort((a, b) => b - a);
  let longestStreakDays = 0, currentStreakDays = 0, run = 0;
  for (let i = 0; i < values.length; i++) {
    run = i > 0 && values[i - 1] === values[i] + 1 ? run + 1 : 1;
    longestStreakDays = Math.max(longestStreakDays, run);
    if (values[0] >= today - 1 && values[i] === values[0] - i) currentStreakDays = i + 1;
  }
  return { currentStreakDays, longestStreakDays };
}
export async function dashboard(request, response) {
  const user = request.user._id;
  const [days, recentLogs, totalGoals, completedGoals] = await Promise.all([
    LearningLog.aggregate([{ $match: { user } }, { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$loggedAt", timezone: "UTC" } },
      minutes: { $sum: "$durationMinutes" }, count: { $sum: 1 },
    } }]),
    LearningLog.find({ user }).sort({ loggedAt: -1, _id: -1 }).limit(5),
    Goal.countDocuments({ user }),
    Goal.countDocuments({ user, $expr: { $gte: ["$currentValue", "$targetValue"] } }),
  ]);
  response.json({ totalMinutes: days.reduce((sum, day) => sum + day.minutes, 0),
    totalLogs: days.reduce((sum, day) => sum + day.count, 0), ...streaks(days.map(day => day._id)),
    totalGoals, completedGoals, recentLogs: recentLogs.map(publicRecord) });
}
