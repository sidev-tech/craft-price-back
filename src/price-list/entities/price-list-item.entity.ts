import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PriceList } from './price-list.entity';

@Entity('price_list_items')
export class PriceListItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'price_list_id' })
  priceListId: string;

  @ManyToOne(() => PriceList, (pl) => pl.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'price_list_id' })
  priceList: PriceList;

  /** Відображуване найменування позиції */
  @Column()
  name: string;

  /** Знімок даних рядка каталогу (усі колонки) */
  @Column({ name: 'display_data', type: 'jsonb', default: {} })
  displayData: Record<string, unknown>;

  /** Які ключі колонок відображати в PDF */
  @Column({ name: 'visible_column_keys', type: 'jsonb', default: [] })
  visibleColumnKeys: string[];

  /** Мітки колонок { key → label } для заголовків таблиці PDF */
  @Column({ name: 'column_labels', type: 'jsonb', default: {} })
  columnLabels: Record<string, string>;

  /** Кількість */
  @Column({ type: 'decimal', precision: 15, scale: 4, default: 1 })
  quantity: number;

  /** Ціна за одиницю (редагована) */
  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 15,
    scale: 4,
    default: 0,
  })
  unitPrice: number;

  /** Рядок прихований у публічній версії PDF */
  @Column({ name: 'is_hidden', default: false })
  isHidden: boolean;

  /** Примітка до позиції */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /** Посилання на рядок каталогу-джерела (nullable) */
  @Column({ name: 'catalog_row_id', type: 'varchar', nullable: true })
  catalogRowId: string | null;

  @Column({ name: 'catalog_id', type: 'varchar', nullable: true })
  catalogId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
