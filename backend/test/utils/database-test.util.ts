import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

let postgresContainer: StartedPostgreSqlContainer;
let dataSource: DataSource;

/**
 * Start PostgreSQL container and create DataSource for integration tests
 */
export async function setupTestDatabase(): Promise<DataSource> {
  if (!postgresContainer) {
    postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_password')
      .start();
  }

  dataSource = new DataSource({
    type: 'postgres',
    host: postgresContainer.getHost(),
    port: postgresContainer.getPort(),
    username: postgresContainer.getUsername(),
    password: postgresContainer.getPassword(),
    database: postgresContainer.getDatabase(),
    entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
    synchronize: true, // Auto-create schema for tests
    logging: false,
  });

  await dataSource.initialize();
  return dataSource;
}

/**
 * Clean all data from the database
 */
export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  const entities = dataSource.entityMetadatas;

  for (const entity of entities) {
    const repository = dataSource.getRepository(entity.name);
    await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
  }
}

/**
 * Tear down test database and container
 */
export async function teardownTestDatabase(): Promise<void> {
  if (dataSource && dataSource.isInitialized) {
    await dataSource.destroy();
  }

  if (postgresContainer) {
    await postgresContainer.stop();
  }
}

/**
 * Get the current DataSource instance
 */
export function getTestDataSource(): DataSource {
  return dataSource;
}
