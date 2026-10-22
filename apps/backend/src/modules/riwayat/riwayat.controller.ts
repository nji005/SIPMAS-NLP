import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';

export async function getRiwayat(req: Request, res: Response) {
  try {
    // Ambil userId dari token terverifikasi di server (req.user), hilangkan celah IDOR!
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Akses ditolak. Silakan login terlebih dahulu." });
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 500));
    const skip = (page - 1) * limit;

    const totalCount = await prisma.laporan.count({
      where: {
        userId: Number(userId),
      },
    });

    const daftarRiwayat = await prisma.laporan.findMany({
      where: {
        userId: Number(userId),
      },
      skip,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
    });

    res.setHeader('X-Total-Count', totalCount.toString());
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    return res.status(200).json(daftarRiwayat);
  } catch (error) {
    logger.error({ err: error }, "ERROR GET RIWAYAT:");
    return res.status(500).json({ message: "Terjadi kesalahan server saat mengambil data riwayat." });
  }
}

