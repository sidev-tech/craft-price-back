import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Catalog } from './catalog.entity';

@Entity('catalog_rows')
export class CatalogRow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Row values keyed by CatalogColumn.key */
  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>;

  /** Sequential row number within the catalog (auto-incremented) */
  @Column({ name: 'row_number', type: 'int' })
  rowNumber: number;

  @Column({ name: 'catalog_id' })
  catalogId: string;

  @ManyToOne(() => Catalog, (catalog) => catalog.rows, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalog_id' })
  catalog: Catalog;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
