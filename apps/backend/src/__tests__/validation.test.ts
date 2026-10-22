import { Request, Response } from 'express';
import {
  createLaporanSchema,
  patchLaporanStatusSchema,
  patchUserRoleSchema,
} from '../middlewares/validate';
import { patchAdminLaporan, patchAdminUsers } from '../modules/admin/admin.controller';
import prisma from '../lib/prisma';

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    laporan: {
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe('Validation Schemas & P2025 Error Mapping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const createMockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  describe('createLaporanSchema', () => {
    it('harus menerima data laporan valid', () => {
      const validData = {
        judul: 'Jalan Rusak di Lingkungan Ramanuju',
        isi: 'Terdapat lubang besar sedalam 20cm di pertigaan jalan utama.',
        lokasi: 'Kecamatan Citangkil',
        tanggal: '2026-10-15',
        kategori: 'Infrastruktur',
      };

      const result = createLaporanSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.judul).toBe('Jalan Rusak di Lingkungan Ramanuju');
        expect(result.data.kategori).toBe('Infrastruktur');
      }
    });

    it('harus menolak judul > 150 karakter', () => {
      const invalidData = {
        judul: 'A'.repeat(151),
        isi: 'Deskripsi isi laporan',
      };

      const result = createLaporanSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('maksimal 150 karakter');
      }
    });

    it('harus menolak isi > 5000 karakter', () => {
      const invalidData = {
        judul: 'Judul Valid',
        isi: 'A'.repeat(5001),
      };

      const result = createLaporanSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('maksimal 5000 karakter');
      }
    });

    it('harus menolak lokasi > 191 karakter', () => {
      const invalidData = {
        judul: 'Judul Valid',
        isi: 'Isi Valid',
        lokasi: 'L'.repeat(192),
      };

      const result = createLaporanSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('maksimal 191 karakter');
      }
    });

    it('harus menolak format tanggal tidak valid', () => {
      const invalidData = {
        judul: 'Judul Valid',
        isi: 'Isi Valid',
        tanggal: 'tanggal-sembarangan',
      };

      const result = createLaporanSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('Format tanggal tidak valid');
      }
    });

    it('harus mengubah kategori di luar daftar putih menjadi Lainnya', () => {
      const data = {
        judul: 'Judul Valid',
        isi: 'Isi Valid',
        kategori: 'KategoriSembarangan123',
      };

      const result = createLaporanSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kategori).toBe('Lainnya');
      }
    });

    it('harus mempertahankan kategori whitelist dengan kapitalisasi rapi', () => {
      const data = {
        judul: 'Judul Valid',
        isi: 'Isi Valid',
        kategori: 'lingkungan',
      };

      const result = createLaporanSchema.safeParse(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.kategori).toBe('Lingkungan');
      }
    });
  });

  describe('patchLaporanStatusSchema & patchUserRoleSchema', () => {
    it('harus memvalidasi status laporan yang diizinkan', () => {
      expect(patchLaporanStatusSchema.safeParse({ id: 10, status: 'PROSES' }).success).toBe(true);
      expect(patchLaporanStatusSchema.safeParse({ id: 10, status: 'SELESAI' }).success).toBe(true);
      expect(patchLaporanStatusSchema.safeParse({ id: 10, status: 'DITOLAK' }).success).toBe(false);
    });

    it('harus memvalidasi role user yang diizinkan', () => {
      expect(patchUserRoleSchema.safeParse({ id: 5, role: 'ADMIN' }).success).toBe(true);
      expect(patchUserRoleSchema.safeParse({ id: 5, role: 'WARGA' }).success).toBe(true);
      expect(patchUserRoleSchema.safeParse({ id: 5, role: 'SUPERADMIN' }).success).toBe(false);
    });
  });

  describe('Prisma P2025 -> 404 Mapping', () => {
    it('patchAdminLaporan harus memetakan P2025 ke 404', async () => {
      const p2025Error = new Error('Record to update not found.') as any;
      p2025Error.code = 'P2025';
      (prisma.laporan.update as jest.Mock).mockRejectedValue(p2025Error);

      const req = {
        body: { id: 9999, status: 'PROSES' },
      } as Request;
      const res = createMockResponse();

      await patchAdminLaporan(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Laporan tidak ditemukan.' })
      );
    });

    it('patchAdminUsers harus memetakan P2025 ke 404 saat update', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 9999,
        nama: 'User Ghost',
        role: 'WARGA',
      });

      const p2025Error = new Error('Record to update not found.') as any;
      p2025Error.code = 'P2025';
      (prisma.user.update as jest.Mock).mockRejectedValue(p2025Error);

      const req = {
        user: { id: 1, role: 'ADMIN' },
        body: { id: 9999, role: 'ADMIN' },
      } as unknown as Request;
      const res = createMockResponse();

      await patchAdminUsers(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Pengguna tidak ditemukan.' })
      );
    });
  });
});
