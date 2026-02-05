import { Repository } from 'typeorm';

/**
 * Create a mock TypeORM repository
 */
export function createMockRepository<T>(): jest.Mocked<Repository<T>> {
  return {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findAndCount: jest.fn(),
    findBy: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    remove: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
      getMany: jest.fn(),
      getManyAndCount: jest.fn(),
      execute: jest.fn(),
    })),
  } as any;
}

/**
 * Create a mock with pre-configured responses
 */
export function createMockRepositoryWithData<T>(data: Partial<T>[]): jest.Mocked<Repository<T>> {
  const mockRepo = createMockRepository<T>();
  mockRepo.find.mockResolvedValue(data as T[]);
  mockRepo.findOne.mockImplementation(async () => data[0] as T);
  mockRepo.save.mockImplementation(async (entity) => entity as T);
  return mockRepo;
}
