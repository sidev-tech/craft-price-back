import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ColumnType } from '../enums/column-type.enum';
import { Catalog } from './catalog.entity';

@Entity('catalog_columns')
export class CatalogColumn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Internal key used as the key in catalog_rows.data JSONB */
  @Column()
  key: string;

  /** User-visible label */
  @Column()
  label: string;

  @Column({ type: 'enum', enum: ColumnType, default: ColumnType.TEXT })
  type: ColumnType;

  @Column({ name: 'column_order', type: 'int' })
  order: number;

  /** Default columns (the 4 base ones) cannot be deleted */
  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  /** Used for SELECT type — list of allowed values */
  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null;

  @Column({ name: 'catalog_id' })
  catalogId: string;

  @ManyToOne(() => Catalog, (catalog) => catalog.columns, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'catalog_id' })
  catalog: Catalog;
}
