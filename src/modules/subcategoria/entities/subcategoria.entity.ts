import { Column, CreateDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Category } from "../../categories/entities/category.entity";
import { Product } from "../../products/entity/product.entity";
import { SubCategoryAttribute } from "../subcategoria-attributes/entities/subcategoria-attribute.entity";

@Entity('sub_categories')
export class SubCategory {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column()
    name!: string;

    @ManyToOne(() => Category, category => category.subCategories, {
        onDelete: 'CASCADE',
    })
    category!: Category;

    @OneToMany(
        () => SubCategoryAttribute, 
        attribute => attribute.subCategory,
    )
    attributes! : SubCategoryAttribute[];

    @OneToMany(() => Product, product => product.subCategory)
    products!: Product[];
    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}