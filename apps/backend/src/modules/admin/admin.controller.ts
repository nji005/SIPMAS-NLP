import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { logger } from '../../lib/logger';


// --- ADMIN LAPORAN ---
export async function getAdminLaporan(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 500));
    const skip = (page - 1) * limit;

    const totalCount = await prisma.laporan.count();
    const daftarLaporan = await prisma.laporan.findMany({
      skip,
      take: limit,
      include: {
        user: {
          select: {
            nik: true,
            nama: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.setHeader('X-Total-Count', totalCount.toString());
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    return res.status(200).json(daftarLaporan);
  } catch (error) {
    logger.error({ err: error }, "ERROR GET ADMIN LAPORAN API");
    return res.status(500).json({ message: "Gagal mengambil data laporan." });
  }
}

export async function patchAdminLaporan(req: Request, res: Response) {
  try {
    const { id, status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ message: "ID dan status wajib ditentukan!" });
    }

    const validStatuses = ["PENDING", "PROSES", "SELESAI"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: "Status tidak valid!" });
    }

    const updatedLaporan = await prisma.laporan.update({
      where: {
        id: Number(id),
      },
      data: {
        status: status,
      },
    });

    return res.status(200).json({
      message: "Status laporan berhasil diperbarui!",
      laporan: updatedLaporan,
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ message: "Laporan tidak ditemukan." });
    }
    logger.error({ err: error }, "ERROR PATCH ADMIN LAPORAN API");
    return res.status(500).json({ message: "Gagal memperbarui status laporan." });
  }
}

// --- ADMIN USERS ---
export async function getAdminUsers(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 500));
    const skip = (page - 1) * limit;

    const totalCount = await prisma.user.count();
    const daftarUser = await prisma.user.findMany({
      skip,
      take: limit,
      select: {
        id: true,
        nik: true,
        nama: true,
        email: true,
        role: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.setHeader('X-Total-Count', totalCount.toString());
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    return res.status(200).json(daftarUser);
  } catch (error) {
    logger.error({ err: error }, "ERROR GET ADMIN USERS API");
    return res.status(500).json({ message: "Gagal mengambil data pengguna." });
  }
}

export async function patchAdminUsers(req: Request, res: Response) {
  try {
    const { id, role } = req.body;

    if (!id || !role) {
      return res.status(400).json({ message: "ID dan Role wajib ditentukan!" });
    }

    const validRoles = ["WARGA", "ADMIN"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Role tidak valid!" });
    }

    const targetUserId = Number(id);

    // 1. Admin tidak boleh menurunkan role dirinya sendiri
    if (req.user && req.user.id === targetUserId && role !== 'ADMIN') {
      return res.status(400).json({
        message: "Anda tidak dapat menurunkan peran (role) akun Anda sendiri!",
      });
    }

    // 2. Ambil user target
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, nama: true, role: true },
    });

    if (!targetUser) {
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }

    // 3. Tidak boleh menurunkan admin terakhir dalam sistem
    if (targetUser.role === 'ADMIN' && role !== 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' },
      });
      if (adminCount <= 1) {
        return res.status(400).json({
          message: "Tidak dapat menurunkan peran admin terakhir dalam sistem!",
        });
      }
    }

    // 4. Update role dan naikkan tokenVersion pengguna target agar sesinya segera dicabut
    const updatedUser = await prisma.user.update({
      where: {
        id: targetUserId,
      },
      data: {
        role: role,
        tokenVersion: { increment: 1 },
      },
      select: {
        id: true,
        nama: true,
        role: true,
      },
    });

    return res.status(200).json({
      message: `Role ${updatedUser.nama} berhasil diubah menjadi ${updatedUser.role}`,
      user: updatedUser,
    });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ message: "Pengguna tidak ditemukan." });
    }
    logger.error({ err: error }, 'ERROR PATCH ADMIN USERS API');
    return res.status(500).json({ message: "Gagal memperbarui role pengguna." });
  }
}
// In-memory cache 60 detik per (range, category)
interface AnalyticsCacheEntry {
  data: any;
  expiresAt: number;
}
const analyticsCache = new Map<string, AnalyticsCacheEntry>();

// Helper normalisasi kategori langsung dari kolom database
export function normalizeCategory(cat: string | null, predCat: string | null): string {
  const target = (cat || predCat || '').toLowerCase();
  if (target.includes('infrastruktur')) return 'Infrastruktur';
  if (target.includes('lingkungan')) return 'Lingkungan';
  if (target.includes('ketertiban') || target.includes('keamanan')) return 'Keamanan';
  if (target.includes('pelayanan')) return 'Pelayanan';
  return 'Lainnya';
}

function buildDateRangeWhere(range: string, now: Date): Prisma.LaporanWhereInput | null {
  if (range === 'HARI_INI' || range === 'MINGGU_INI' || range === 'BULAN_INI') {
    const days = range === 'HARI_INI' ? 1 : range === 'MINGGU_INI' ? 7 : 30;
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return {
      OR: [
        {
          AND: [
            { tanggalKejadian: { not: null } },
            { tanggalKejadian: { gte: threshold } },
          ],
        },
        {
          AND: [
            { tanggalKejadian: null },
            { createdAt: { gte: threshold } },
          ],
        },
      ],
    };
  }
  return null;
}

function buildCategoryWhere(categoryFilter: string): Prisma.LaporanWhereInput | null {
  if (!categoryFilter || categoryFilter === 'SEMUA') return null;
  const upper = categoryFilter.toUpperCase();
  if (upper === 'INFRASTRUKTUR') {
    return {
      OR: [
        { kategori: { contains: 'infrastruktur' } },
        {
          AND: [
            { OR: [{ kategori: null }, { kategori: '' }] },
            { kategoriPrediksi: { contains: 'infrastruktur' } },
          ],
        },
      ],
    };
  }
  if (upper === 'LINGKUNGAN') {
    return {
      OR: [
        { kategori: { contains: 'lingkungan' } },
        {
          AND: [
            { OR: [{ kategori: null }, { kategori: '' }] },
            { kategoriPrediksi: { contains: 'lingkungan' } },
          ],
        },
      ],
    };
  }
  if (upper === 'KEAMANAN') {
    return {
      OR: [
        { kategori: { contains: 'keamanan' } },
        { kategori: { contains: 'ketertiban' } },
        {
          AND: [
            { OR: [{ kategori: null }, { kategori: '' }] },
            {
              OR: [
                { kategoriPrediksi: { contains: 'keamanan' } },
                { kategoriPrediksi: { contains: 'ketertiban' } },
              ],
            },
          ],
        },
      ],
    };
  }
  if (upper === 'PELAYANAN') {
    return {
      OR: [
        { kategori: { contains: 'pelayanan' } },
        {
          AND: [
            { OR: [{ kategori: null }, { kategori: '' }] },
            { kategoriPrediksi: { contains: 'pelayanan' } },
          ],
        },
      ],
    };
  }
  if (upper === 'LAINNYA') {
    return {
      AND: [
        {
          AND: [
            { NOT: { kategori: { contains: 'infrastruktur' } } },
            { NOT: { kategori: { contains: 'lingkungan' } } },
            { NOT: { kategori: { contains: 'keamanan' } } },
            { NOT: { kategori: { contains: 'ketertiban' } } },
            { NOT: { kategori: { contains: 'pelayanan' } } },
          ],
        },
        {
          OR: [
            { AND: [{ kategori: { not: null } }, { NOT: { kategori: '' } }] },
            {
              AND: [
                { NOT: { kategoriPrediksi: { contains: 'infrastruktur' } } },
                { NOT: { kategoriPrediksi: { contains: 'lingkungan' } } },
                { NOT: { kategoriPrediksi: { contains: 'keamanan' } } },
                { NOT: { kategoriPrediksi: { contains: 'ketertiban' } } },
                { NOT: { kategoriPrediksi: { contains: 'pelayanan' } } },
              ],
            },
          ],
        },
      ],
    };
  }
  return null;
}

function buildSqlQueryConditions(range: string, categoryFilter: string, now: Date): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`status = 'SELESAI'`];

  if (range === 'HARI_INI' || range === 'MINGGU_INI' || range === 'BULAN_INI') {
    const days = range === 'HARI_INI' ? 1 : range === 'MINGGU_INI' ? 7 : 30;
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    conditions.push(
      Prisma.sql`((tanggalKejadian IS NOT NULL AND tanggalKejadian >= ${threshold}) OR (tanggalKejadian IS NULL AND createdAt >= ${threshold}))`
    );
  }

  if (categoryFilter && categoryFilter !== 'SEMUA') {
    const catUpper = categoryFilter.toUpperCase();
    if (catUpper === 'INFRASTRUKTUR') {
      conditions.push(
        Prisma.sql`(LOWER(COALESCE(kategori, '')) LIKE '%infrastruktur%' OR ((kategori IS NULL OR kategori = '') AND LOWER(COALESCE(kategoriPrediksi, '')) LIKE '%infrastruktur%'))`
      );
    } else if (catUpper === 'LINGKUNGAN') {
      conditions.push(
        Prisma.sql`(LOWER(COALESCE(kategori, '')) LIKE '%lingkungan%' OR ((kategori IS NULL OR kategori = '') AND LOWER(COALESCE(kategoriPrediksi, '')) LIKE '%lingkungan%'))`
      );
    } else if (catUpper === 'KEAMANAN') {
      conditions.push(
        Prisma.sql`((LOWER(COALESCE(kategori, '')) LIKE '%keamanan%' OR LOWER(COALESCE(kategori, '')) LIKE '%ketertiban%') OR ((kategori IS NULL OR kategori = '') AND (LOWER(COALESCE(kategoriPrediksi, '')) LIKE '%keamanan%' OR LOWER(COALESCE(kategoriPrediksi, '')) LIKE '%ketertiban%')))`
      );
    } else if (catUpper === 'PELAYANAN') {
      conditions.push(
        Prisma.sql`(LOWER(COALESCE(kategori, '')) LIKE '%pelayanan%' OR ((kategori IS NULL OR kategori = '') AND LOWER(COALESCE(kategoriPrediksi, '')) LIKE '%pelayanan%'))`
      );
    } else if (catUpper === 'LAINNYA') {
      conditions.push(
        Prisma.sql`(
          (LOWER(COALESCE(kategori, '')) NOT LIKE '%infrastruktur%' AND LOWER(COALESCE(kategori, '')) NOT LIKE '%lingkungan%' AND LOWER(COALESCE(kategori, '')) NOT LIKE '%keamanan%' AND LOWER(COALESCE(kategori, '')) NOT LIKE '%ketertiban%' AND LOWER(COALESCE(kategori, '')) NOT LIKE '%pelayanan%')
          AND
          ((kategori IS NOT NULL AND kategori != '') OR (LOWER(COALESCE(kategoriPrediksi, '')) NOT LIKE '%infrastruktur%' AND LOWER(COALESCE(kategoriPrediksi, '')) NOT LIKE '%lingkungan%' AND LOWER(COALESCE(kategoriPrediksi, '')) NOT LIKE '%keamanan%' AND LOWER(COALESCE(kategoriPrediksi, '')) NOT LIKE '%ketertiban%' AND LOWER(COALESCE(kategoriPrediksi, '')) NOT LIKE '%pelayanan%'))
        )`
      );
    }
  }

  return conditions;
}

// --- ADMIN ANALYTICS ---
export async function getAdminAnalytics(req: Request, res: Response) {
  try {
    const range = (req.query.range as string) || 'SEMUA';
    const categoryFilter = (req.query.category as string) || 'SEMUA';

    // Cek in-memory cache 60 detik
    const cacheKey = `${range}:${categoryFilter}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.status(200).json(cached.data);
    }

    const now = new Date();
    const whereConditions: Prisma.LaporanWhereInput[] = [];

    const dateWhere = buildDateRangeWhere(range, now);
    if (dateWhere) {
      whereConditions.push(dateWhere);
    }

    const catWhere = buildCategoryWhere(categoryFilter);
    if (catWhere) {
      whereConditions.push(catWhere);
    }

    const whereClause: Prisma.LaporanWhereInput = whereConditions.length > 0 ? { AND: whereConditions } : {};

    // 1. GroupBy untuk agregasi status, kategori, prediksi, dan lokasi tanpa load seluruh tabel
    const groups = await prisma.laporan.groupBy({
      by: ['status', 'kategori', 'kategoriPrediksi', 'lokasi'],
      where: whereClause,
      _count: {
        _all: true,
      },
    });

    let totalLaporan = 0;
    let laporanAktif = 0;
    let laporanSelesai = 0;

    const kategoriCount: Record<string, number> = {
      'Infrastruktur': 0,
      'Lingkungan': 0,
      'Keamanan': 0,
      'Pelayanan': 0,
      'Lainnya': 0,
    };

    const hotspotCount: Record<string, number> = {};

    for (const group of groups) {
      const count = group._count._all;
      totalLaporan += count;

      if (group.status === 'PENDING' || group.status === 'PROSES') {
        laporanAktif += count;
      } else if (group.status === 'SELESAI') {
        laporanSelesai += count;
      }

      const cat = normalizeCategory(group.kategori, group.kategoriPrediksi);
      kategoriCount[cat] = (kategoriCount[cat] || 0) + count;

      const rawLoc = (group.lokasi || '').trim();
      if (rawLoc && rawLoc.toLowerCase() !== 'tidak diketahui') {
        const locName = rawLoc
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        hotspotCount[locName] = (hotspotCount[locName] || 0) + count;
      }
    }

    const kategoriStats = Object.keys(kategoriCount)
      .map((key) => {
        const count = kategoriCount[key];
        const percentage = totalLaporan === 0 ? 0 : Math.round((count / totalLaporan) * 100);
        return {
          name: key,
          pct: `${percentage}%`,
          rawPct: percentage,
          light: key === 'Lainnya',
        };
      })
      .sort((a, b) => b.rawPct - a.rawPct);

    const finalHotspots = Object.keys(hotspotCount)
      .map((locName) => ({
        name: locName,
        city: 'Wilayah Aduan',
        count: hotspotCount[locName] || 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4)
      .map((h, idx) => ({
        rank: (idx + 1).toString(),
        name: h.name,
        city: h.city,
        count: h.count,
      }));

    // 2. Aggregate untuk rata-rata confidence score klasifikasi NLP nyata
    const aggConfidence = await prisma.laporan.aggregate({
      where: {
        ...whereClause,
        confidenceScore: { not: null },
      },
      _avg: {
        confidenceScore: true,
      },
    });

    let avgConfidence: number | null = null;
    if (aggConfidence._avg.confidenceScore !== null && aggConfidence._avg.confidenceScore !== undefined) {
      const avg = aggConfidence._avg.confidenceScore * 100;
      avgConfidence = Math.round(avg * 10) / 10;
    }

    // 3. $queryRaw untuk rata-rata durasi penyelesaian laporan SELESAI
    const sqlConditions = buildSqlQueryConditions(range, categoryFilter, now);
    let avgResolution: number | null = null;

    try {
      const queryRes = await prisma.$queryRaw<Array<{ avgHours: number | null }>>`
        SELECT AVG(GREATEST(0, TIMESTAMPDIFF(MICROSECOND, createdAt, updatedAt) / 1000.0)) / (1000 * 60 * 60) AS avgHours
        FROM Laporan
        WHERE ${Prisma.join(sqlConditions, ' AND ')}
      `;

      if (queryRes && queryRes[0] && queryRes[0].avgHours !== null && queryRes[0].avgHours !== undefined) {
        avgResolution = Math.round(Number(queryRes[0].avgHours) * 10) / 10;
      }
    } catch (queryErr) {
      logger.error({ err: queryErr }, 'Gagal menghitung avgResolution via $queryRaw');
    }

    const responseData = {
      total: totalLaporan,
      aktif: laporanAktif,
      selesai: laporanSelesai,
      kategoriStats,
      hotspots: finalHotspots,
      avgResolution,
      avgConfidence,
    };

    // Simpan ke cache 60 detik
    analyticsCache.set(cacheKey, {
      data: responseData,
      expiresAt: Date.now() + 60 * 1000,
    });

    return res.status(200).json(responseData);
  } catch (error) {
    logger.error({ err: error }, 'ERROR ANALYTICS API:');
    return res.status(500).json({ message: 'Gagal mengambil data analitik.' });
  }
}

