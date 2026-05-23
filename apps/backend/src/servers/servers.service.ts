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

  async create(data: { name: string }) {
    return this.prisma.server.create({
      data: {
        name: data.name,
      },
    });
  }

  async update(id: string, data: { name?: string; status?: string }) {
    return this.prisma.server.update({
      where: { id },
      data: {
        name: data.name,
        status: data.status,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.server.delete({
      where: { id },
    });
  }
}
