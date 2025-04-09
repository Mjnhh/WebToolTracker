import express from 'express';
import { Express } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';

// Khởi tạo Express app
const app: Express = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Cài đặt các routes
import authRoutes from "./routes/auth";
import chatRoutes from "./routes/chat";
import supportRoutes from "./routes/support";
import contactRoutes from "./routes/contact";
import adminRoutes from "./routes/admin";
import spotifyRoutes from "./routes/spotify";
import vouchersRouter from './routes/vouchers';

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/spotify", spotifyRoutes);
app.use("/api/vouchers", vouchersRouter);

export default app; 