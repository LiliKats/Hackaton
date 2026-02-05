import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource } from 'typeorm';

/**
 * Builder for creating test modules with common configurations
 */
export class TestModuleBuilder {
  private imports: any[] = [];
  private providers: any[] = [];
  private controllers: any[] = [];
  private dataSource?: DataSource;

  /**
   * Add ConfigModule with test configuration
   */
  withConfig(): this {
    this.imports.push(
      ConfigModule.forRoot({
        envFilePath: '.env.test',
        isGlobal: true,
      }),
    );
    return this;
  }

  /**
   * Add TypeORM with test database
   */
  withDatabase(dataSource: DataSource): this {
    this.dataSource = dataSource;
    this.imports.push(
      TypeOrmModule.forRoot({
        ...dataSource.options,
      } as any),
    );
    return this;
  }

  /**
   * Add TypeORM repositories
   */
  withRepositories(...entities: any[]): this {
    this.imports.push(TypeOrmModule.forFeature(entities));
    return this;
  }

  /**
   * Add custom imports
   */
  withImports(...modules: any[]): this {
    this.imports.push(...modules);
    return this;
  }

  /**
   * Add providers
   */
  withProviders(...providers: any[]): this {
    this.providers.push(...providers);
    return this;
  }

  /**
   * Add controllers
   */
  withControllers(...controllers: any[]): this {
    this.controllers.push(...controllers);
    return this;
  }

  /**
   * Build the testing module
   */
  async build(): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: this.imports,
      providers: this.providers,
      controllers: this.controllers,
    }).compile();
  }
}

/**
 * Create a new TestModuleBuilder instance
 */
export function createTestModule(): TestModuleBuilder {
  return new TestModuleBuilder();
}
