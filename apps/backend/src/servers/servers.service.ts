import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServersService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.server.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async create(data: { name: string; base_salary?: number }) {
    return this.prisma.server.create({
      data: {
        name: data.name,
        base_salary: data.base_salary !== undefined ? Number(data.base_salary) : 0,
      },
    });
  }

  async update(id: string, data: { name?: string; status?: string; base_salary?: number }) {
    return this.prisma.server.update({
      where: { id },
      data: {
        name: data.name,
        status: data.status,
        base_salary: data.base_salary !== undefined ? Number(data.base_salary) : undefined,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.server.delete({
      where: { id },
    });
  }
}
