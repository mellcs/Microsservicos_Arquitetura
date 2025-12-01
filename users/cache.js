import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "redis-cache",
  port: process.env.REDIS_PORT || 6379,
});

export default function cache(seconds) {
  return (req, res, next) => {
    const key = req.originalUrl;

    redis.get(key, (err, data) => {
      if (err) return next();
      if (data) return res.json(JSON.parse(data));

      res.sendResponse = res.json;
      res.json = (body) => {
        if (seconds === Infinity) {
          redis.set(key, JSON.stringify(body));
        } else {
          redis.setex(key, seconds, JSON.stringify(body));
        }
        res.sendResponse(body);
      };

      next();
    });
  };
}
