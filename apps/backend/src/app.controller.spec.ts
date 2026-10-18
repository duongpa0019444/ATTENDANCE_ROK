import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { AuditLogsService } from './audit-logs/audit-logs.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const mockPrisma = {
      getSetting: jest.fn(),
      setSetting: jest.fn(),
    };
    const mockConfig = {
      get: jest.fn(),
    };
    const mockAudit = {
      log: jest.fn(),
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: AuditLogsService, useValue: mockAudit },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
